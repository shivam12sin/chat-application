import type { Preview } from '@storybook/react';
import '../src/index.css';

const preview: Preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
        backgrounds: {
            default: 'dark',
            values: [
                { name: 'dark', value: '#0a0a0f' },
                { name: 'cosmic', value: '#12121a' },
                { name: 'light', value: '#f0f0f5' },
            ],
        },
        layout: 'centered',
    },
};

export default preview;
