import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  style,
  ...props 
}) => {
  const baseStyle: React.CSSProperties = {
    padding: size === 'sm' ? '4px 12px' : size === 'lg' ? '12px 24px' : '8px 16px',
    fontSize: size === 'sm' ? '11px' : '13px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'all 0.15s ease',
    border: '1px solid transparent',
    borderRadius: '0px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  };

  const variants = {
    primary: {
      backgroundColor: 'var(--fg)',
      color: 'var(--bg)',
      borderColor: 'var(--fg)',
    },
    secondary: {
      backgroundColor: 'var(--muted)',
      color: 'var(--fg)',
      borderColor: 'var(--border)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--fg)',
      borderColor: 'var(--border-bold)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--muted-fg)',
      borderColor: 'transparent',
    }
  };

  return (
    <button 
      style={{ ...baseStyle, ...variants[variant], ...style }} 
      onMouseOver={(e) => {
        if (variant === 'outline') e.currentTarget.style.backgroundColor = '#f9f9f9';
        if (variant === 'primary') e.currentTarget.style.opacity = '0.9';
      }}
      onMouseOut={(e) => {
        if (variant === 'outline') e.currentTarget.style.backgroundColor = 'transparent';
        if (variant === 'primary') e.currentTarget.style.opacity = '1';
      }}
      {...props}
    >
      {children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ 
    border: '1px solid var(--border)', 
    padding: '24px', 
    backgroundColor: '#fff',
    ...style 
  }}>
    {children}
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{
    fontSize: '9px',
    fontWeight: '800',
    textTransform: 'uppercase',
    padding: '2px 6px',
    backgroundColor: '#000',
    color: '#fff',
    letterSpacing: '0.1em'
  }}>
    {children}
  </span>
);

export const Divider: React.FC = () => (
  <div className="w-full h-[1px] bg-neutral-100 my-8" />
);

export const Container: React.FC<{ children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }> = ({ children, size = 'xl' }) => {
  const sizes = {
    sm: 'max-w-xl',
    md: 'max-w-2xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl'
  };
  return <div className={`w-full mx-auto px-6 ${sizes[size]}`}>{children}</div>;
};
