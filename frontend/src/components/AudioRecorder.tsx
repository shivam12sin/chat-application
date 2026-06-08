import React, { useState, useRef, useEffect } from 'react';
import ChromeButton from './ChromeButton';
// import { cn } from '../utils/theme';

interface AudioRecorderProps {
    onRecordingComplete: (audioBlob: Blob) => void;
    onCancel: () => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, onCancel }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        startRecording();
        return () => {
            stopRecording();
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                onRecordingComplete(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);

            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error('Failed to start recording', err);
            onCancel();
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-4 px-4 py-2 bg-mono-surface rounded-glass border border-white/20 animate-fade-up">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(255,50,50,0.5)]" />
            <span className="text-mono-text font-mono">{formatDuration(duration)}</span>
            <ChromeButton
                onClick={() => {
                    stopRecording(); // This will trigger onstop which calls onRecordingComplete
                }}
                variant="circle"
                className="text-white min-w-[36px] min-h-[36px]"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            </ChromeButton>
            <ChromeButton
                onClick={() => {
                    if (mediaRecorderRef.current) {
                        // Stop without saving
                        mediaRecorderRef.current.onstop = null;
                        mediaRecorderRef.current.stop();
                        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                    }
                    onCancel();
                }}
                variant="circle"
                className="text-mono-muted hover:text-mono-text min-w-[36px] min-h-[36px]"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </ChromeButton>
        </div>
    );
};

export default AudioRecorder;
