import type { Meta, StoryObj } from '@storybook/react';
import ChromeButton from './ChromeButton';
import { Send, Plus, Settings, Search } from 'lucide-react';

const meta = {
    title: 'Components/ChromeButton',
    component: ChromeButton,
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'Premium chrome-styled button with interactive rim and active state effects. Core UI component of the Cosmic Liquid Glass theme.',
            },
        },
    },
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'circle'],
            description: 'Button variant style',
        },
        disabled: {
            control: 'boolean',
            description: 'Disable the button',
        },
    },
} satisfies Meta<typeof ChromeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default button
export const Default: Story = {
    args: {
        children: 'Click me',
    },
};

// With icon
export const WithIcon: Story = {
    args: {
        children: (
            <>
                <Send className="w-4 h-4 mr-2" />
                Send Message
            </>
        ),
    },
};

// Circle variant (icon button)
export const Circle: Story = {
    args: {
        variant: 'circle',
        children: <Plus className="w-5 h-5" />,
    },
};

// Disabled
export const Disabled: Story = {
    args: {
        disabled: true,
        children: 'Disabled',
    },
};

// Button group example
export const ButtonGroup: Story = {
    args: {
        children: <Search className="w-4 h-4" />,
        variant: 'circle',
    },
    render: (args) => (
        <div className="flex gap-2">
            <ChromeButton {...args}>
                <Search className="w-4 h-4" />
            </ChromeButton>
            <ChromeButton {...args}>
                <Plus className="w-4 h-4" />
            </ChromeButton>
            <ChromeButton {...args}>
                <Settings className="w-4 h-4" />
            </ChromeButton>
        </div>
    ),
};
