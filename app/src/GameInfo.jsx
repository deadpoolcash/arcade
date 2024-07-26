import React from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';

const InfoCard = ({ title, content, image, highlight }) => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {image && (
            <CardMedia
                component="img"
                height="140"
                image={image}
                alt={title}
            />
        )}
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" component="div" sx={{ mb: 2 }}>
                {title}
            </Typography>
            <Box sx={{ mt: 'auto' }}>
                {typeof content === 'string' ? (
                    <Typography variant="h5">{content}</Typography>
                ) : (
                    content
                )}
            </Box>
        </CardContent>
    </Card>
);

const GameInfo = ({betSize, multiplier, probability, reward}) => {
    const cardData = [
        { title: 'Selected Bet Size', content: betSize + " SOL", highlight: true },
        { title: 'Selected Multiplier', content: multiplier + "x" },
        { title: 'Win Probability', content: (probability * 100).toFixed(2) + "%" },
        { title: 'Solana Reward', content: reward.toFixed(4) + " SOL" },
    ];

    return (
        <Grid container spacing={2}>
            {cardData.map((card, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                    <InfoCard title={card.title} content={card.content} />
                </Grid>
            ))}
        </Grid>
    );
};

export default GameInfo;