package com.kdjz.clone;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * 小伙记账 —— WebView 壳
 * 离线运行 file:///android_asset/www/index.html；
 * 数据持久化走 SQLite（dbLoad/dbSave 桥）；返回键/边缘手势转发给网页 nativeBack()；
 * 文件选择（账单附件 / JSON 导入）直拉系统选择器。
 */
public class MainActivity extends Activity {

    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int REQ_FILE = 51001;

    /* ---------- SQLite 持久化 ---------- */
    private SQLiteDatabase db;
    private static final String[] RECORD_COLS = {
            "id", "book_id", "type", "amount", "category_id", "account_id", "to_account_id",
            "date", "note", "member", "tags", "photos", "created_at", "updated_at"};

    private synchronized SQLiteDatabase db() {
        if (db == null) {
            db = openOrCreateDatabase("xiaohu.db", MODE_PRIVATE, null);
            db.execSQL("CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT NOT NULL)");
            db.execSQL("CREATE TABLE IF NOT EXISTS records(" +
                    "id TEXT PRIMARY KEY, book_id TEXT, type TEXT, amount REAL," +
                    "category_id TEXT, account_id TEXT, to_account_id TEXT," +
                    "date TEXT, note TEXT, member TEXT, tags TEXT, photos TEXT," +
                    "created_at INTEGER, updated_at INTEGER)");
        }
        return db;
    }

    /** 读取全部状态（meta.head + records 全表）→ JSON 字符串；无数据返回 "" */
    private String dbLoadInternal() {
        try {
            String head = null;
            Cursor c = db().rawQuery("SELECT v FROM meta WHERE k='head'", null);
            if (c.moveToFirst()) head = c.getString(0);
            c.close();
            if (head == null) return "";
            JSONObject state = new JSONObject(head);
            JSONArray recs = new JSONArray();
            Cursor r = db().rawQuery(
                    "SELECT id,book_id,type,amount,category_id,account_id,to_account_id,date,note,member,tags,photos,created_at,updated_at FROM records ORDER BY created_at",
                    null);
            while (r.moveToNext()) {
                JSONObject o = new JSONObject();
                o.put("id", r.getString(0));
                o.put("bookId", r.getString(1));
                o.put("type", r.getString(2));
                o.put("amount", r.isNull(3) ? 0 : r.getDouble(3));
                putIfNotEmpty(o, "categoryId", r.getString(4));
                putIfNotEmpty(o, "accountId", r.getString(5));
                putIfNotEmpty(o, "toAccountId", r.getString(6));
                o.put("date", r.getString(7));
                putIfNotEmpty(o, "note", r.getString(8));
                putIfNotEmpty(o, "member", r.getString(9));
                o.put("tags", new JSONArray(r.getString(10) == null ? "[]" : r.getString(10)));
                o.put("photos", new JSONArray(r.getString(11) == null ? "[]" : r.getString(11)));
                o.put("createdAt", r.getLong(12));
                o.put("updatedAt", r.getLong(13));
                recs.put(o);
            }
            r.close();
            state.put("records", recs);
            return state.toString();
        } catch (Exception e) {
            log("dbLoad failed: " + e);
            return "";
        }
    }

    private void putIfNotEmpty(JSONObject o, String key, String v) throws Exception {
        o.put(key, v == null ? "" : v);
    }

    /** 全量落库：meta.head（除 records 外的头部）+ records 整表重建（事务） */
    private void dbSaveInternal(String json) {
        try {
            JSONObject s = new JSONObject(json);
            JSONArray recs = s.optJSONArray("records");
            if (recs != null) s.remove("records");
            SQLiteDatabase d = db();
            d.beginTransaction();
            try {
                ContentValues meta = new ContentValues();
                meta.put("k", "head");
                meta.put("v", s.toString());
                d.insertWithOnConflict("meta", null, meta, SQLiteDatabase.CONFLICT_REPLACE);
                d.execSQL("DELETE FROM records");
                if (recs != null) {
                    for (int i = 0; i < recs.length(); i++) {
                        JSONObject o = recs.getJSONObject(i);
                        ContentValues row = new ContentValues();
                        row.put("id", o.optString("id", "r" + i));
                        row.put("book_id", o.optString("bookId"));
                        row.put("type", o.optString("type"));
                        row.put("amount", o.optDouble("amount", 0));
                        row.put("category_id", o.optString("categoryId"));
                        row.put("account_id", o.optString("accountId"));
                        row.put("to_account_id", o.optString("toAccountId"));
                        row.put("date", o.optString("date"));
                        row.put("note", o.optString("note"));
                        row.put("member", o.optString("member"));
                        JSONArray tags = o.optJSONArray("tags");
                        row.put("tags", tags == null ? "[]" : tags.toString());
                        JSONArray photos = o.optJSONArray("photos");
                        row.put("photos", photos == null ? "[]" : photos.toString());
                        row.put("created_at", o.optLong("createdAt", 0));
                        row.put("updated_at", o.optLong("updatedAt", 0));
                        d.insert("records", null, row);
                    }
                }
                d.setTransactionSuccessful();
            } finally {
                d.endTransaction();
            }
        } catch (final Exception e) {
            log("dbSave failed: " + e);
            runOnUiThread(() -> Toast.makeText(MainActivity.this,
                    "数据库保存失败：" + e.getMessage(), Toast.LENGTH_LONG).show());
        }
    }

    private void dbClearInternal() {
        try {
            SQLiteDatabase d = db();
            d.beginTransaction();
            try {
                d.execSQL("DELETE FROM meta");
                d.execSQL("DELETE FROM records");
                d.setTransactionSuccessful();
            } finally {
                d.endTransaction();
            }
        } catch (Exception e) { log("dbClear failed: " + e); }
    }

    private void log(String msg) { android.util.Log.w("XiaoHuDroid", msg); }

    /* ---------- 异步落盘：单线程队列 + 最新优先合并（JS 永不阻塞） ---------- */
    private final Object writeLock = new Object();
    private String pendingJson;
    private boolean writerRunning;
    private final java.util.concurrent.ExecutorService writer =
            java.util.concurrent.Executors.newSingleThreadExecutor();

    private void enqueueWrite(final String json) {
        synchronized (writeLock) {
            pendingJson = json;               // 最新快照覆盖旧的
            if (writerRunning) return;
            writerRunning = true;
        }
        writer.execute(new Runnable() {
            @Override public void run() {
                while (true) {
                    String job;
                    synchronized (writeLock) { job = pendingJson; pendingJson = null; }
                    if (job == null) {
                        synchronized (writeLock) { writerRunning = false; }
                        return;
                    }
                    dbSaveInternal(job);
                }
            }
        });
    }

    @Override
    protected void onDestroy() {
        try {
            writer.shutdown();
            writer.awaitTermination(3, java.util.concurrent.TimeUnit.SECONDS);
        } catch (Throwable ignore) {}
        super.onDestroy();
    }

    /* ---------- 生命周期 ---------- */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setBackgroundColor(Color.parseColor("#F5F6F8"));
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = cb;
                // 直拉系统文件选择器：不用 Intent.createChooser（部分机型会闪退/失效）
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String[] accept = params.getAcceptTypes();
                String mime = "image/*";
                if (accept != null) {
                    for (String a : accept) {
                        if (a != null && a.contains("/")) { mime = a; break; }
                        if (a != null && a.contains("json")) { mime = "*/*"; break; }
                    }
                }
                if ("*/*".equals(mime) && accept != null) {
                    for (String a : accept) if (a != null && a.contains("json")) mime = "application/*";
                }
                i.setType(mime);
                try {
                    startActivityForResult(i, REQ_FILE);
                } catch (Exception e) {
                    filePathCallback = null;
                    toast("设备上没有可用的文件选择器");
                    return false;
                }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        /* 开启 WebView 远程调试（chrome://inspect），便于真机问题排查 */
        WebView.setWebContentsDebuggingEnabled(true);
        web.loadUrl("file:///android_asset/www/index.html");
        setContentView(web);
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().setStatusBarColor(Color.parseColor("#F0600A"));
        }
        // Android 13+：注册预测性返回回调（边缘手势），转发给网页
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    new OnBackInvokedCallback() {
                        public void onBackInvoked() { handleNativeBack(); }
                    });
        }
    }

    /** 文件选择结果（账单附件 / JSON 导入）；兼容 getData 与 ClipData 两种返回 */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE && filePathCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK) {
                if (data != null && data.getData() != null) {
                    results = new Uri[]{ data.getData() };
                } else if (data != null && data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    results = new Uri[n];
                    for (int i = 0; i < n; i++) results[i] = data.getClipData().getItemAt(i).getUri();
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    /** 返回：先问网页（关弹层/回上级），未消费则退出应用 */
    private void handleNativeBack() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript("(window.nativeBack ? window.nativeBack() : false)", new ValueCallback<String>() {
            @Override public void onReceiveValue(String v) {
                if (!"true".equals(v)) finish();
            }
        });
    }

    /** Android 12 及以下：返回键走这里（13+ 走 OnBackInvokedCallback） */
    @Override
    public void onBackPressed() { handleNativeBack(); }

    private void toast(String msg) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show());
    }

    /** JS 桥：SQLite 存取 + 导出保存（dbSave 异步，立即返回不阻塞网页） */
    private class Bridge {
        @JavascriptInterface
        public String dbLoad() { return dbLoadInternal(); }

        @JavascriptInterface
        public void dbSave(String json) { enqueueWrite(json); }

        @JavascriptInterface
        public void dbClear() { dbClearInternal(); }

        /** 导出文件保存到系统「下载」目录（Android 10+）或应用导出目录 */
        @JavascriptInterface
        public void saveFile(final String name, final String mime, final String content) {
            try {
                byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new IllegalStateException("无法创建下载文件");
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        os.write(bytes);
                    }
                    toast("已保存到「下载」目录：" + name);
                } else {
                    java.io.File dir = new java.io.File(getExternalFilesDir(null), "exports");
                    if (!dir.exists()) dir.mkdirs();
                    java.io.File f = new java.io.File(dir, name);
                    try (java.io.FileOutputStream fo = new java.io.FileOutputStream(f)) {
                        fo.write(bytes);
                    }
                    toast("已保存：" + f.getAbsolutePath());
                }
            } catch (final Exception e) {
                toast("保存失败：" + e.getMessage());
            }
        }
    }
}
