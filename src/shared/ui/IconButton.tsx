import type { ReactNode } from 'react';

import { Button, type ButtonProps, type ComponentSize } from './Button';

const iconSizes: Record<ComponentSize, string> = {
  xs: 'size-11 !p-0',
  sm: 'size-11 !p-0',
  md: 'size-11 !p-0',
  lg: 'size-12 !p-0',
};

export interface IconButtonProps
  extends Omit<ButtonProps, 'aria-label' | 'children' | 'leadingIcon' | 'trailingIcon'> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, size = 'md', className = '', children, ...props }: IconButtonProps) {
  return (
    <Button
      size={size}
      className={`${iconSizes[size]} ${className}`}
      {...props}
      aria-label={label}
    >
      {children}
    </Button>
  );
}
