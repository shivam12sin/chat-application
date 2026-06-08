import React, { useState } from 'react';
import Modal from './Modal';
import ChromeButton from './ChromeButton';

interface PollCreatorProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (question: string, options: string[], allowMultiple: boolean) => void;
}

const PollCreator: React.FC<PollCreatorProps> = ({ isOpen, onClose, onSubmit }) => {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [allowMultiple, setAllowMultiple] = useState(false);

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const addOption = () => {
        if (options.length < 10) {
            setOptions([...options, '']);
        }
    };

    const removeOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = options.filter((_, i) => i !== index);
            setOptions(newOptions);
        }
    };

    const handleSubmit = () => {
        const validOptions = options.filter(o => o.trim());
        if (question.trim() && validOptions.length >= 2) {
            onSubmit(question, validOptions, allowMultiple);
            // Reset form
            setQuestion('');
            setOptions(['', '']);
            setAllowMultiple(false);
            onClose();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Create Poll"
            onConfirm={handleSubmit}
            confirmText="Create Poll"
            contentClassName="space-y-4"
        >
            <div>
                <label className="block text-sm font-medium text-mono-text mb-1">Question</label>
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a question..."
                    className="input-glass w-full"
                    autoFocus
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-mono-text">Options</label>
                {options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                        <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            placeholder={`Option ${index + 1}`}
                            className="input-glass flex-1"
                        />
                        {options.length > 2 && (
                            <ChromeButton
                                variant="circle"
                                onClick={() => removeOption(index)}
                                className="p-2 text-mono-muted hover:text-red-400"
                            >
                                ✕
                            </ChromeButton>
                        )}
                    </div>
                ))}
                {options.length < 10 && (
                    <ChromeButton
                        onClick={addOption}
                        className="text-sm px-3 py-1"
                    >
                        + Add Option
                    </ChromeButton>
                )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-mono-glass-border">
                <input
                    type="checkbox"
                    id="allowMultiple"
                    checked={allowMultiple}
                    onChange={(e) => setAllowMultiple(e.target.checked)}
                    className="rounded border-mono-glass-border bg-mono-surface-2 text-mono-glass-highlight focus:ring-mono-glass-highlight/50"
                />
                <label htmlFor="allowMultiple" className="text-sm text-mono-text cursor-pointer">
                    Allow multiple answers
                </label>
            </div>
        </Modal>
    );
};

export default PollCreator;
