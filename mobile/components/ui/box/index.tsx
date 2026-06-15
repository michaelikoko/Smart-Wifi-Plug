import React from 'react';
import { View } from 'react-native';

type BoxProps = React.ComponentPropsWithoutRef<typeof View> & {
  className?: string;
};

const Box = React.forwardRef<React.ElementRef<typeof View>, BoxProps>(
  ({ className, ...props }, ref) => {
    return <View ref={ref} {...props} className={className} />;
  }
);

Box.displayName = 'Box';

export { Box };
