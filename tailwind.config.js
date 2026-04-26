/** @type {import('tailwindcss').Config} */
module.exports = {
  purge: false,  // 禁用 purge 以保留所有类
  theme: {
    extend: {
      screens: {
        xs: '300px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
      colors: {
        primary: '#2979fa',
        'primary-dark': '#1765e0',
        'primary-darker': '#1350c6',
        'primary-light': '#e0eaff',
        'primary-lighter': '#f0f4ff',
        'gray-custom': '#f3f4f6',
      },
    },
  },
  plugins: [],
}
