package com.fittrack.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FitTrackAudioFocus")
public class FitTrackAudioFocusPlugin extends Plugin {
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private boolean ownsFocus = false;
    private final AudioManager.OnAudioFocusChangeListener focusListener = focusChange -> {};

    @PluginMethod
    public void requestDucking(PluginCall call) {
        if (audioManager == null) {
            audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        }
        if (audioManager == null) {
            call.reject("AudioManager unavailable");
            return;
        }
        if (ownsFocus) {
            resolve(call, true);
            return;
        }

        final int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener(focusListener)
                .build();
            result = audioManager.requestAudioFocus(focusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                focusListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            );
        }

        ownsFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        resolve(call, ownsFocus);
    }

    @PluginMethod
    public void abandon(PluginCall call) {
        abandonFocus();
        call.resolve();
    }

    private void resolve(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    private void abandonFocus() {
        if (!ownsFocus || audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
            audioManager.abandonAudioFocusRequest(focusRequest);
        } else {
            audioManager.abandonAudioFocus(focusListener);
        }
        ownsFocus = false;
        focusRequest = null;
    }

    @Override
    protected void handleOnDestroy() {
        abandonFocus();
        super.handleOnDestroy();
    }
}
