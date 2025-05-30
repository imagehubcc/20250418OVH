
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Custom colors for our tech theme
				'tech-dark': '#121526',
				'tech-blue': '#00B8FF',
				'tech-purple': '#9B66FF',
				'tech-red': '#FF4D4D',
				'tech-green': '#36D399',
				'tech-yellow': '#FFBD59',
				'tech-navy': '#1E2A45',
				'tech-gray': '#8A94A6',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'pulse-glow': {
					'0%, 100%': { 
						opacity: '1',
						boxShadow: '0 0 5px rgba(0, 184, 255, 0.3), 0 0 10px rgba(0, 184, 255, 0.2), 0 0 15px rgba(0, 184, 255, 0.1)'
					},
					'50%': { 
						opacity: '0.8',
						boxShadow: '0 0 10px rgba(0, 184, 255, 0.5), 0 0 20px rgba(0, 184, 255, 0.3), 0 0 30px rgba(0, 184, 255, 0.1)'
					}
				},
				'data-flow': {
					'0%': { transform: 'translateX(0)' },
					'100%': { transform: 'translateX(-100%)' }
				},
				'fade-in-up': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-5px)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'pulse-glow': 'pulse-glow 2s infinite',
				'data-flow': 'data-flow 15s linear infinite',
				'fade-in-up': 'fade-in-up 0.3s ease-out',
				'float': 'float 3s ease-in-out infinite'
			},
			fontFamily: {
				mono: ['Roboto Mono', 'monospace'],
				sans: ['Inter', 'sans-serif']
			},
			backgroundImage: {
				'tech-gradient': 'linear-gradient(135deg, #121526 0%, #1E2A45 100%)',
				'blue-pulse': 'radial-gradient(circle, rgba(0,184,255,0.2) 0%, rgba(0,184,255,0) 70%)',
				'data-lines': 'url("/data-lines.svg")'
			},
			boxShadow: {
				'tech': '0 0 10px rgba(0, 184, 255, 0.3)',
				'tech-hover': '0 0 15px rgba(0, 184, 255, 0.5)',
				'tech-card': '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 184, 255, 0.1)'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
