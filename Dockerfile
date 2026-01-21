FROM node:slim as build
WORKDIR /home/code
COPY . ./
RUN cd /home/code
RUN rm -rf node_modules
RUN addgroup -S react-native-sdk-group && adduser -S react-native-sdk -G react-native-sdk-group
USER react-native-sdk

