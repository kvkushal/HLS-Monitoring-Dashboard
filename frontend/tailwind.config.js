/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#030712', // Darker, richer background
                surface: '#111827', // Slightly lighter surface
                primary: '#6366f1', // Indigo-500
                secondary: '#94a3b8', // Slate-400
                accent: '#8b5cf6', // Violet-500
                success: '#10b981', // Emerald-500
                error: '#f43f5e', // Rose-500
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
