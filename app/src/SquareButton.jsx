import React from 'react';
import { Button } from '@mui/material';
import { styled } from '@mui/system';

const SquareButton = styled(Button)(({ theme }) => ({
    width: '120px',
    height: '120px',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    lineHeight: 1.2,
}));


export default SquareButton;