// Notification sound utility with quiet hours support
let notificationAudio: HTMLAudioElement | null = null;

export const playNotificationSound = (
    quietHoursActive: boolean = false
): void => {
    // Don't play during quiet hours
    if (quietHoursActive) return;

    try {
        if (!notificationAudio) {
            // Use a simple beep/notification sound - in production, replace with actual sound file
            notificationAudio = new Audio(
                'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQAAPZ7X2ryiPQAAa5zT2cmuWgAAf5nQ1sqwYgAAhpfO0sqxZQAAi5TM0cmxZgAAj5HK0MixZgAAkY/I0MewZQAAko3G0MavZAAAko3F0MauYwAAkozF0MauYwAAkozE0MatYgAAkYvE0MatYgAAkIvD0MasYQAAj4rD0MasYQAAjorC0MWsYAAAjYnC0MWrYAAAjInB0MWrXwAAi4jB0MWrXwAAi4fA0MWqXgAAiofA0MSqXgAAiYa/0MSqXQAAiIa/0MSpXQAAiIW+0MSpXAAAh4S+0MSnXAAAhoS+0MSnWwAAhYO90MSmWwAAhYO90MSmWgAAhIK80MSmWgAAg4K80MOlWQAAgoG70MOlWQAAgoG70MOkWAAAf4C60MOkWAAAfn+50MOjVwAAfX+40MOjVgAAfH650MOiVgAAe3640MOiVQAAenx30MKhVQAAeXx20MKhVAAAeHt10MKgVAAAd3t00MKgUwAAd3pz0MGfUwAAdnpy0MGfUgAAdXlx0MGfUgAAdXlw0MGfUQAAdHhv0MGfUQAAdHdv0MGfUAAAdHYv0cOfUAAAc3Yu0cGfTwAAc3Us0cKeUAAAcXUr0cGdTwAAb3Qt0cCcTwAAbnMu0cCbTwAAbXIv0cCaUAAAa3Ev0b+ZUAAAaXAw0r+YUQA='
            );
            notificationAudio.volume = 0.3;
        }
        notificationAudio.currentTime = 0;
        notificationAudio.play().catch(() => {
            // Autoplay blocked, user needs to interact first
        });
    } catch {
        // Audio not supported
    }
};

export const isQuietHoursActive = (
    settings?: { quietHours?: { start: string; end: string } }
): boolean => {
    if (!settings?.quietHours?.start || !settings?.quietHours?.end) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = settings.quietHours.start.split(':').map(Number);
    const [endH, endM] = settings.quietHours.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};
