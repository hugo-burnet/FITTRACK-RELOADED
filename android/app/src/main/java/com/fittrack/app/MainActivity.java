package com.fittrack.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Plugins must enter the Bridge builder before BridgeActivity creates it.
        registerPlugin(FitTrackAudioFocusPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
