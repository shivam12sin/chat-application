import type { Meta, StoryObj } from '@storybook/react';
import Avatar from './Avatar';

const meta = {
    title: 'Components/Avatar',
    component: Avatar,
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'User avatar component with fallback to initials. Supports different sizes and online status indicator.',
            },
        },
    },
    tags: ['autodocs'],
    argTypes: {
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg', 'xl'],
            description: 'Avatar size',
        },
        name: {
            control: 'text',
            description: 'User name for generating initials',
        },
        src: {
            control: 'text',
            description: 'Image URL',
        },
    },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default with initials
export const Default: Story = {
    args: {
        name: 'John Doe',
        size: 'md',
    },
};

// With image
export const WithImage: Story = {
    args: {
        name: 'Jane Smith',
        src: 'https://i.pravatar.cc/150?u=jane',
        size: 'md',
    },
};

// Sizes
export const Small: Story = {
    args: { name: 'User', size: 'sm' },
};

export const Medium: Story = {
    args: { name: 'User', size: 'md' },
};

export const Large: Story = {
    args: { name: 'User', size: 'lg' },
};

export const ExtraLarge: Story = {
    args: { name: 'User', size: 'xl' },
};

// Avatar group example
export const AvatarGroup: Story = {
    args: {
        name: 'User',
        size: 'sm',
    },
    render: (args) => (
        <div className="flex -space-x-2">
            <Avatar {...args} name="Alice" />
            <Avatar {...args} name="Bob" />
            <Avatar {...args} name="Charlie" />
            <Avatar {...args} name="Diana" />
        </div>
    ),
};
