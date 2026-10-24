import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { ActivityIndicator, View } from 'react-native';
import type { AnswerWheelProps } from './AnswerWheelCanvas';
import { colors } from '../../theme/theme';

export default function AnswerWheel(props: AnswerWheelProps) {
  return (
    <WithSkiaWeb
      getComponent={() => import('./AnswerWheelCanvas')}
      componentProps={props}
      opts={{ locateFile: (file) => `/${file}` }}
      fallback={
        <View
          style={{
            width: props.size,
            height: props.size,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={colors.lime} />
        </View>
      }
    />
  );
}
