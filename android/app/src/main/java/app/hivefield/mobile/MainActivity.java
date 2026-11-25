package app.hivefield.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import androidx.activity.EdgeToEdge;

/** Independent recovery QA package: NEVER overwrite an installed historical app. */
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OfflineAsrPlugin.class);
        registerPlugin(DeviceFilesPlugin.class);
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
    }
}
