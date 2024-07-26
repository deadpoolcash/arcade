import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    typography: {
        fontFamily: 'PressStart2P, sans-serif',
    },
    palette: {
        mode: 'dark',
        background: {
            default: '#000000',
        },
        primary: {
            main: '#ffffff', // Light color for primary elements
        },
        secondary: {
            main: '#ffffff', // Light color for secondary elements
        },
        text: {
            primary: '#ffffff', // Light color for text
            secondary: '#b0b0b0', // Slightly darker color for secondary text
        },
        action: {
            active: '#ffffff',
            hover: '#ffffff',
            selected: '#ffffff',
            disabled: '#ffffff',
            disabledBackground: '#ffffff',
        },
    },
    components: {
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiInputBase-root': {
                        color: '#ffffff',
                    },
                    '& .MuiInputLabel-root': {
                        color: '#b0b0b0',
                    },
                    '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                            borderColor: '#ffffff',
                        },
                        '&:hover fieldset': {
                            borderColor: '#ffffff',
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: '#ffffff',
                        },
                    },
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    backgroundColor: '#B22222',
                    color: 'white',
                },
            },
        },
        MuiFormLabel: {
            styleOverrides: {
                root: {
                    color: '#ffffff',
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                select: {
                    backgroundColor: '#000000', // Set the background color to black
                    color: '#ffffff', // Set the text color to white
                },
                icon: {
                    color: '#ffffff', // Set the icon color to white
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    backgroundColor: '#000000', // Set the menu item background color to black
                    color: '#ffffff', // Set the menu item text color to white
                    '&:hover': {
                        backgroundColor: '#333333', // Optional: Set a different color for hover state
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundColor: '#000000', // Set the background color of the paper to black
                },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: {
                    color: '#b22222', // Neon green text
                    borderColor: '#b22222', // Neon green border
                    '&.Mui-selected': {
                        backgroundColor: '#ffffff', // Neon green background when selected
                        color: '#000000', // Black text when selected
                        '&:hover': {
                            backgroundColor: '#ffffff',
                        },
                    },
                    '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                },
            },
        },
    },
});

export default theme;

