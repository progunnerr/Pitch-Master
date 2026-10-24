import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { ActivityIndicator, View } from 'react-native';
import type { WheelProps } from './ChromaticWheel';
import { colors } from '../../theme/theme';

export default function Wheel(props: WheelProps) {
  return (
    <WithSkiaWeb
      getComponent={() => import('./ChromaticWheel')}
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
