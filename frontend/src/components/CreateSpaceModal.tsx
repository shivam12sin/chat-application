import React, { useState } from 'react';
import Modal from './Modal';
import socketService from '../services/socket';
import { useToast } from '../hooks/useToast';
import { Users, Briefcase, Coffee, Lock } from 'lucide-react';
import { cn } from '../utils/theme';

interface CreateSpaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSpaceCreated?: (space: any) => void;
}

const TONES = [
    {
        id: 'social',
        label: 'Social',
        icon: Users,
        description: 'For friends and hangouts.',
        color: 'bg-blue-500/10 border-blue-500/20 text-blue-400'
    },
    {
        id: 'focus',
        label: 'Focus',
        icon: Coffee, // Or Brain/Zap if available
        description: 'Quiet study or deep work.',
        color: 'bg-purple-500/10 border-purple-500/20 text-purple-400'
    },
    {
        id: 'work',
        label: 'Work',
        icon: Briefcase,
        description: 'Projects and collaboration.',
        color: 'bg-amber-500/10 border-amber-500/20 text-amber-400'
    },
    {
        id: 'private',
        label: 'Private',
        icon: Lock,
        description: 'Encrypted and invite-only.',
        color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    }
];

const CreateSpaceModal: React.FC<CreateSpaceModalProps> = ({
    isOpen,
    onClose,
    onSpaceCreated
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedTone, setSelectedTone] = useState('social');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addToast } = useToast();

    const handleSubmit = () => {
        console.log('[CreateSpaceModal] handleSubmit called', { name, description, tone: selectedTone });

        if (!name.trim()) {
            addToast('Space name is required', 'error');
            return;
        }

        setIsSubmitting(true);
        console.log('[CreateSpaceModal] Calling socketService.createSpace...');

        socketService.createSpace({
            name,
            description,
            tone: selectedTone,
            initialMembers: []
        }, (response) => {
            console.log('[CreateSpaceModal] Socket response:', response);
            setIsSubmitting(false);
            if (response.error) {
                addToast(response.error, 'error');
            } else {
                addToast('Space created successfully', 'success');
                onSpaceCreated?.(response.space);
                onClose();
                // Reset form
                setName('');
                setDescription('');
                setSelectedTone('social');
            }
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Create a Shared Space"
            onConfirm={handleSubmit}
            confirmText={isSubmitting ? 'Creating...' : 'Create Space'}
            className="max-w-xl"
        >
            <div className="space-y-6">
                {/* Name */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-mono-muted uppercase tracking-wider">
                        Space Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Late Night Coding, Weekend Trip..."
                        className="w-full bg-mono-surface-2 border border-mono-glass-border rounded-lg px-4 py-3 text-mono-text focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all font-medium text-lg placeholder:text-mono-muted/50"
                        autoFocus
                    />
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-mono-muted uppercase tracking-wider">
                        Description (Optional)
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What's this space for?"
                        className="w-full bg-mono-surface-2 border border-mono-glass-border rounded-lg px-4 py-3 text-mono-text focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all resize-none min-h-[80px]"
                    />
                </div>

                {/* Tone Selector */}
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-mono-muted uppercase tracking-wider">
                        Set the Tone
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {TONES.map((tone) => {
                            const Icon = tone.icon;
                            const isSelected = selectedTone === tone.id;

                            return (
                                <button
                                    key={tone.id}
                                    onClick={() => setSelectedTone(tone.id)}
                                    className={cn(
                                        "flex flex-col items-start p-3 rounded-xl border transition-all duration-200 text-left",
                                        isSelected
                                            ? `bg-mono-surface border-accent-primary shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-accent-primary`
                                            : "bg-mono-surface-2 border-transparent hover:bg-mono-surface hover:border-mono-glass-border opacity-70 hover:opacity-100"
                                    )}
                                >
                                    <div className={cn("p-2 rounded-lg mb-2", tone.color)}>
                                        <Icon size={18} />
                                    </div>
                                    <span className="text-sm font-semibold text-mono-text mb-0.5">
                                        {tone.label}
                                    </span>
                                    <span className="text-xs text-mono-muted leading-tight">
                                        {tone.description}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default CreateSpaceModal;
