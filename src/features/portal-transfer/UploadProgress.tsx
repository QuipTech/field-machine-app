import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors } from '../../config/colors';

const UploadProgress = ({ percent }: { percent: number }) => (
  <View>
    <ActivityIndicator color={colors.primaryBright} />
    <Text
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      {percent}% uploaded
    </Text>
  </View>
);

export default UploadProgress;
