import React, { useState, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Connect } from 'connect-react-native-sdk';

type AndroidEdgeToEdgeMode = 'before' | 'after';

const RADIO_OPTIONS: Record<string, string> = {
  STG: 'https://acme.finicitystg.com',
  Prod: 'https://acmelending.net',
  'Enter Redirect URL': ''
};

const RADIO_TEST_IDS: Record<string, string> = {
  STG: 'stg',
  Prod: 'prod',
  'Enter Redirect URL': 'enter-redirect-url'
};

const App = () => {
  const [url, setUrl] = useState('');
  const [pressable, setPressable] = useState(false);
  const [show, setShow] = useState(false);
  const [androidEdgeToEdgeMode, setAndroidEdgeToEdgeMode] =
    useState<AndroidEdgeToEdgeMode>('after');
  const [selectedOption, setSelectedOption] = useState('Prod');
  const [redirectUrl, setRedirectUrl] = useState(RADIO_OPTIONS.Prod);
  const urlInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const handleUrl = (text: string) => {
    setUrl(text);
    setPressable(text.length > 0);
  };

  const onConnectWithUrl = (mode: AndroidEdgeToEdgeMode) => {
    let nextUrl = url;

    if (Platform.OS === 'android' && nextUrl.includes('localhost')) {
      nextUrl = nextUrl.replace('localhost', '10.0.2.2');
    }

    setUrl(nextUrl);
    setAndroidEdgeToEdgeMode(mode);
    setShow(true);
  };

  const onPressHandler = (mode: AndroidEdgeToEdgeMode) => {
    if (pressable) {
      onConnectWithUrl(mode);
    }
    urlInputRef.current?.clear();
  };

  const eventHandlers = {
    onCancel: (event: any) => {
      console.log('cancel event received', event);
      setShow(false);
      handleUrl('');
    },
    onDone: (event: any) => {
      console.log('done event received', event);
      setShow(false);
      handleUrl('');
    },
    onError: (event: any) => {
      console.log('error event received', event);
      setShow(false);
      handleUrl('');
    },
    onLoad: () => {
      console.log('loaded event received');
    },
    onRoute: (event: any) => {
      console.log('route event received', event);
    },
    onUser: (event: any) => {
      console.log('user event received', event);
    }
  };

  const renderRadioComponent = () => (
    <>
      <View testID="redirect-url-radio-group" style={styles.radioGroup}>
        {Object.keys(RADIO_OPTIONS).map(option => (
          <View key={option} style={styles.radioContainer}>
            <TouchableOpacity
              testID={`radio-option-${RADIO_TEST_IDS[option]}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedOption === option }}
              style={styles.radioButton}
              onPress={() => {
                setSelectedOption(option);
                setRedirectUrl(RADIO_OPTIONS[option]);
              }}
            >
              <View style={styles.radioOuter}>
                {selectedOption === option && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
            <Text testID={`radio-label-${RADIO_TEST_IDS[option]}`} style={styles.radioText}>
              {option}
            </Text>
          </View>
        ))}
      </View>
      {selectedOption === 'Enter Redirect URL' && (
        <TextInput
          testID="redirect-url-input"
          style={[styles.textInput, styles.redirectTextInput]}
          placeholder="Enter Redirect URL"
          onChangeText={setRedirectUrl}
          value={redirectUrl}
        />
      )}
    </>
  );

  return (
    <SafeAreaProvider>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
          <View style={styles.fullFlex}>
            <SafeAreaView style={styles.safeAreaView}>
              <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              >
                <Text style={styles.textTitle}>Connect SDK demo app</Text>
                <Text style={styles.textInstructions}>
                  To get started, copy/paste a Generate URL value into the field below.
                </Text>
                <Text style={styles.textInstructions}>
                  Android 16 edge-to-edge demo: this launch flow uses the SDK safe-area fix.
                </Text>
                <TextInput
                  ref={urlInputRef}
                  style={styles.textInput}
                  placeholder="Paste Generate URL here"
                  onChangeText={handleUrl}
                />
                {renderRadioComponent()}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    disabled={!pressable}
                    style={
                      pressable ? styles.buttonFrameStyleEnabled : styles.buttonFrameStyleDisabled
                    }
                    onPress={() => onPressHandler('after')}
                  >
                    <Text
                      style={
                        pressable ? styles.buttonTextStyleEnabled : styles.buttonTextStyleDisabled
                      }
                    >
                      Launch Connect
                    </Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
              {show === true && (
                <Connect
                  connectUrl={url}
                  eventHandlers={eventHandlers}
                  redirectUrl={redirectUrl}
                  androidEdgeToEdgeMode={androidEdgeToEdgeMode}
                />
              )}
            </SafeAreaView>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeAreaView: { flex: 1 },
  fullFlex: { flex: 1 },

  scrollContainer: { flexGrow: 1 },
  background: {
    flex: 1,
    resizeMode: 'cover'
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  textTitle: {
    color: 'black',
    fontSize: 30,
    fontWeight: 'bold',
    width: '85%',
    marginTop: 30
  },
  textInstructions: {
    color: 'black',
    fontSize: 16,
    width: '85%'
  },
  logoStyle: {
    width: 90,
    height: 70,
    marginTop: -50
  },
  textInput: {
    height: 56,
    width: '90%',
    marginTop: 24,
    borderColor: '#C6CDD4',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEFEFE'
  },
  radioGroup: { width: '50%' },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    paddingLeft: 20
  },
  radioButton: { marginRight: 10 },
  radioOuter: {
    height: 24,
    width: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C6CDD4',
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioInner: {
    height: 12,
    width: 12,
    borderRadius: 6,
    backgroundColor: '#000'
  },
  radioText: {
    fontSize: 16,
    color: 'black'
  },
  redirectTextInput: { width: '75%' },
  buttonRow: {
    width: '95%',
    gap: 10
  },
  buttonFrameStyleDisabled: {
    height: 48,
    width: '100%',
    borderRadius: 24,
    marginTop: 12,
    backgroundColor: '#bdc3c7',
    justifyContent: 'center'
  },
  buttonFrameStyleEnabled: {
    height: 48,
    width: '100%',
    borderRadius: 24,
    marginTop: 12,
    backgroundColor: '#d35400',
    justifyContent: 'center'
  },
  buttonTextStyleDisabled: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'black',
    padding: 10,
    textAlign: 'center'
  },
  buttonTextStyleEnabled: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'black',
    padding: 10,
    textAlign: 'center'
  }
});

export default App;
