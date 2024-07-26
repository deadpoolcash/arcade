import React, { useState, useCallback } from 'react';
import { Button, Typography, Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import theme from "./theme.jsx";

const ArcadeForm = ({title, onChange, options, selectedOption}) => {
    // console.log({title, options, selectedOption})
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <div style={{paddingBottom: '30px'}}>
            <Box className="p-4 bg-black text-neon-green border-2 border-neon-green rounded-lg">
                <Typography variant="h5" style={{paddingBottom: '20px'}}>{title}</Typography>
                <ToggleButtonGroup
                    exclusive={true} // Optional, enables exclusive selection
                    size="medium"
                    orientation={isMobile ? 'vertical' : 'horizontal'}
                    className={"space-y-2"}
                >                {options.map((option) => (
                    <ToggleButton
                        value={option}
                        onClick={() => onChange(option)}
                        selected={selectedOption === option }
                    >
                        {option}
                    </ToggleButton>
                ))}
                </ToggleButtonGroup>
            </Box>

        </div>
    );
};

export default ArcadeForm;