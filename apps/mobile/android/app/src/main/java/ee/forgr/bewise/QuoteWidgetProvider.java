package ee.forgr.bewise;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import app.capgo.widgetkit.CapgoNativeWidgetBridge;
import app.capgo.widgetkit.CapgoWidgetKitConstants;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Home screen widget showing the quote of the day over its photo.
 *
 * The app writes today's quote and the reader's theme/language into the Capgo
 * Widget Kit shared store (src/lib/widget.ts) and asks for a reload. On other
 * days the widget fetches the quote itself, so it stays current without
 * opening the app.
 */
public class QuoteWidgetProvider extends AppWidgetProvider {

    private static final String SESSION_ID = "bewise-daily";
    private static final String CACHE_PREFS = "bewise_widget";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(final Context context, final Intent intent) {
        if (CapgoWidgetKitConstants.ACTION_NATIVE_WIDGET_BRIDGE_CHANGED.equals(intent.getAction())) {
            final AppWidgetManager manager = AppWidgetManager.getInstance(context);
            final int[] ids = manager.getAppWidgetIds(new ComponentName(context, QuoteWidgetProvider.class));
            if (ids.length > 0) {
                onUpdate(context, manager, ids);
            }
            return;
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onUpdate(final Context context, final AppWidgetManager manager, final int[] appWidgetIds) {
        final PendingResult pending = goAsync();
        EXECUTOR.execute(() -> {
            try {
                render(context.getApplicationContext(), manager, appWidgetIds);
            } finally {
                pending.finish();
            }
        });
    }

    @Override
    public void onAppWidgetOptionsChanged(final Context context, final AppWidgetManager manager, final int id, final Bundle options) {
        onUpdate(context, manager, new int[] { id });
    }

    private static void render(final Context context, final AppWidgetManager manager, final int[] ids) {
        final JSONObject prefs = readPrefs(context);
        final String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        JSONObject quote = prefs != null ? prefs.optJSONObject("quote") : null;

        // Prefer the app's copy, then our own cached fetch, then the network.
        final SharedPreferences cache = context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE);
        if (quote == null || !today.equals(quote.optString("date"))) {
            final JSONObject cached = parse(cache.getString("quote", null));
            if (cached != null && today.equals(cached.optString("date")) && sameSource(cached, prefs)) {
                quote = cached;
            } else {
                final JSONObject fresh = fetchToday(prefs, today);
                if (fresh != null) {
                    quote = fresh;
                    cache.edit().putString("quote", fresh.toString()).apply();
                } else if (quote == null) {
                    quote = cached;
                }
            }
        }

        final Bitmap photo = quote != null ? loadPhoto(quote.optString("img", "")) : null;
        final String eyebrow = prefs != null && !prefs.optString("eyebrow").isEmpty()
            ? prefs.optString("eyebrow")
            : context.getString(R.string.widget_eyebrow);

        for (final int id : ids) {
            final RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quote);
            views.setTextViewText(R.id.widget_eyebrow, eyebrow);
            final String text = quote != null ? clean(quote.optString("text")) : context.getString(R.string.widget_sample_quote);
            views.setTextViewText(R.id.widget_quote, text);
            if (quote != null) {
                final String author = quote.optString("author").trim();
                views.setTextViewText(R.id.widget_author, author.isEmpty() ? "" : "— " + author);
            }
            if (photo != null) {
                views.setImageViewBitmap(R.id.widget_photo, photo);
            }

            // Small widgets: drop the eyebrow and let the quote use the room.
            final Bundle options = manager.getAppWidgetOptions(id);
            // Portrait size: MIN_WIDTH x MAX_HEIGHT (the other pair is landscape).
            final int width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            final int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 180);
            final boolean small = width < 200 || height < 150;
            views.setViewVisibility(R.id.widget_eyebrow, small ? View.GONE : View.VISIBLE);
            // Room left for the quote: 16dp padding, eyebrow row, author row.
            final int quoteWidth = width - 32;
            final int quoteHeight = height - 32 - (small ? 0 : 18) - 26;
            final int[] fit = fitText(context, text, quoteWidth, quoteHeight, small ? 16 : height > 300 ? 26 : 20, 11);
            views.setTextViewTextSize(R.id.widget_quote, TypedValue.COMPLEX_UNIT_SP, fit[0]);
            views.setInt(R.id.widget_quote, "setMaxLines", fit[1]);

            final Intent open = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            views.setOnClickPendingIntent(
                android.R.id.background,
                PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
            );
            manager.updateAppWidget(id, views);
        }
    }

    /**
     * Largest serif bold size (sp) at which the whole quote fits the box (dp), and the line count that
     * fits at that size. Long quotes shrink instead of pushing the author out of the card; past the
     * minimum size they are ellipsized.
     */
    private static int[] fitText(final Context context, final String text, final int widthDp, final int heightDp, final int maxSp, final int minSp) {
        final DisplayMetrics metrics = context.getResources().getDisplayMetrics();
        final int width = Math.max(1, Math.round(widthDp * metrics.density));
        final int height = Math.max(1, Math.round(heightDp * metrics.density));
        final TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        paint.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
        int size = maxSp;
        for (; size > minSp; size--) {
            paint.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, size, metrics));
            if (StaticLayout.Builder.obtain(text, 0, text.length(), paint, width).build().getHeight() <= height) {
                break;
            }
        }
        paint.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, size, metrics));
        return new int[] { size, Math.max(1, (int) (height / paint.getFontSpacing())) };
    }

    /** Quotes come from many sources: collapse stray double spaces and line breaks. */
    private static String clean(final String text) {
        return text.replaceAll("\\s+", " ").trim();
    }

    private static JSONObject readPrefs(final Context context) {
        try {
            final JSONObject session = new CapgoNativeWidgetBridge(context).loadSession(SESSION_ID);
            return session != null ? session.optJSONObject("state") : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static boolean sameSource(final JSONObject cached, final JSONObject prefs) {
        return prefs == null || (prefs.optString("category").equals(cached.optString("category")) && prefs.optString("lang").equals(cached.optString("lang")));
    }

    private static JSONObject fetchToday(final JSONObject prefs, final String day) {
        try {
            final String api = prefs != null ? prefs.optString("apiUrl", "https://api.bewise.love") : "https://api.bewise.love";
            final String category = prefs != null ? prefs.optString("category", "inspire") : "inspire";
            final String lang = prefs != null ? prefs.optString("lang", deviceLang()) : deviceLang();
            final String user = prefs != null ? prefs.optString("user", "") : "";
            String url = api + "/v1/quotes/today?category=" + enc(category) + "&lang=" + enc(lang) + "&date=" + day;
            if (!user.isEmpty()) {
                url += "&user=" + enc(user);
            }
            final JSONObject quote = parse(new String(download(url), "UTF-8"));
            if (quote != null) {
                // Remember which theme/language this copy belongs to.
                quote.put("category", category).put("lang", lang);
            }
            return quote;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static Bitmap loadPhoto(final String raw) {
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        try {
            String url = raw;
            final Uri uri = Uri.parse(raw);
            if (uri.getHost() != null && uri.getHost().endsWith("unsplash.com")) {
                final Uri.Builder builder = uri.buildUpon().clearQuery();
                for (final String name : uri.getQueryParameterNames()) {
                    if (!java.util.Arrays.asList("w", "h", "fit", "fm", "q", "auto").contains(name)) {
                        builder.appendQueryParameter(name, uri.getQueryParameter(name));
                    }
                }
                url = builder.appendQueryParameter("w", "720").appendQueryParameter("fit", "max")
                    .appendQueryParameter("fm", "jpg").appendQueryParameter("q", "70").build().toString();
            }
            final byte[] bytes = download(url);
            final BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            final BitmapFactory.Options options = new BitmapFactory.Options();
            // RemoteViews bitmaps are size-limited: keep it under ~720px wide.
            options.inSampleSize = Math.max(1, bounds.outWidth / 720);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static byte[] download(final String url) throws Exception {
        final HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(15000);
        try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (connection.getResponseCode() != 200) {
                throw new IllegalStateException("HTTP " + connection.getResponseCode());
            }
            final byte[] buffer = new byte[16384];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        } finally {
            connection.disconnect();
        }
    }

    private static JSONObject parse(final String json) {
        try {
            return json == null ? null : new JSONObject(json);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String enc(final String value) throws Exception {
        return URLEncoder.encode(value, "UTF-8");
    }

    private static String deviceLang() {
        final String lang = Locale.getDefault().getLanguage();
        return java.util.Arrays.asList("en", "fr", "es", "de", "it").contains(lang) ? lang : "en";
    }
}
