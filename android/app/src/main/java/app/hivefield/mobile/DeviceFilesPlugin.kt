package app.hivefield.mobile

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.print.PrintAttributes
import android.print.PrintManager
import android.print.PrintDocumentAdapter
import android.print.PrintAttributes as Attributes
import android.print.PageRange
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.webkit.WebView
import android.webkit.WebViewClient
import android.util.Base64
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "DeviceFiles")
class DeviceFilesPlugin : Plugin() {
    private var choosing = false
    private val reportViews = mutableSetOf<WebView>()

    @PluginMethod
    fun saveDocument(call: PluginCall) {
        synchronized(this) {
            if (choosing) { call.reject("Another file picker is already open"); return }
            val encoded = call.getString("base64")
            if (encoded == null || encoded.length > 27962028) {
                call.reject("Missing file data or export exceeds 20 MiB"); return
            }
            val name = (call.getString("name") ?: "beekeepy-export")
                .replace(Regex("[\\\\/\\p{Cntrl}]"), "_").take(180)
            val mime = call.getString("mimeType")?.substringBefore(';') ?: "application/octet-stream"
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE).setType(mime)
                .putExtra(Intent.EXTRA_TITLE, name)
            choosing = true
            try { startActivityForResult(call, intent, "savePicked") }
            catch (error: Exception) { choosing = false; call.reject("Android file picker unavailable", error) }
        }
    }

    @ActivityCallback
    private fun savePicked(call: PluginCall?, result: ActivityResult) {
        synchronized(this) { choosing = false }
        if (call == null) return
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) {
            call.resolve(JSObject().put("saved", false).put("cancelled", true)); return
        }
        bridge.execute {
            try {
                val bytes = Base64.decode(call.getString("base64"), Base64.DEFAULT)
                check(bytes.size <= 20 * 1024 * 1024) { "Export exceeds 20 MiB" }
                val stream = context.contentResolver.openOutputStream(uri, "wt")
                    ?: error("Document provider did not open the selected file")
                stream.use { it.write(bytes); it.flush() }
                call.resolve(JSObject().put("saved", true))
            } catch (error: Exception) { call.reject("File save failed; selected document may be incomplete", error) }
        }
    }

    @PluginMethod
    fun printPage(call: PluginCall) {
        activity.runOnUiThread {
            try {
                val manager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
                manager.print("Beekeepy", bridge.webView.createPrintDocumentAdapter("Beekeepy"), PrintAttributes.Builder().build())
                call.resolve(JSObject().put("dialogOpened", true))
            } catch (error: Exception) { call.reject("Android printing unavailable", error) }
        }
    }

    @PluginMethod
    fun printHtml(call: PluginCall) {
        val html = call.getString("html")
        if (html.isNullOrBlank() || html.length > 5 * 1024 * 1024) {
            call.reject("Missing or oversized printable report"); return
        }
        activity.runOnUiThread {
            val view = WebView(activity)
            reportViews.add(view)
            view.settings.javaScriptEnabled = false
            view.settings.blockNetworkLoads = true
            view.settings.allowFileAccess = false
            view.settings.allowContentAccess = false
            var opened = false
            view.webViewClient = object : WebViewClient() {
                override fun onPageFinished(web: WebView, url: String) {
                    if (opened) return
                    opened = true
                    try {
                        val delegate = view.createPrintDocumentAdapter("Beekeepy Report")
                        val adapter = object : PrintDocumentAdapter() {
                            override fun onStart() = delegate.onStart()
                            override fun onLayout(old: Attributes?, next: Attributes?, cancel: CancellationSignal?, callback: LayoutResultCallback?, extras: Bundle?) = delegate.onLayout(old, next, cancel, callback, extras)
                            override fun onWrite(pages: Array<out PageRange>?, destination: ParcelFileDescriptor?, cancel: CancellationSignal?, callback: WriteResultCallback?) = delegate.onWrite(pages, destination, cancel, callback)
                            override fun onFinish() { delegate.onFinish(); reportViews.remove(view); view.destroy() }
                        }
                        (context.getSystemService(Context.PRINT_SERVICE) as PrintManager).print("Beekeepy Report", adapter, PrintAttributes.Builder().build())
                        call.resolve(JSObject().put("dialogOpened", true))
                    } catch (error: Exception) { reportViews.remove(view); view.destroy(); call.reject("Report printing unavailable", error) }
                }
            }
            view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
        }
    }

    override fun handleOnDestroy() {
        activity.runOnUiThread { reportViews.toList().forEach { it.destroy() }; reportViews.clear() }
        super.handleOnDestroy()
    }
}
