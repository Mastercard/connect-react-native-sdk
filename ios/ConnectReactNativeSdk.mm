#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ConnectReactNativeSdk, NSObject)

RCT_EXTERN_METHOD(checklink:(NSString *)url
                 withResolver:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(open:(NSDictionary *)options
                 withResolver:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(close)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
