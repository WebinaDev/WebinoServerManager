<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class PanelResetPassword extends ResetPassword
{
    protected function resetUrl($notifiable): string
    {
        $frontend = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $email = urlencode($notifiable->getEmailForPasswordReset());

        return $frontend.'/reset-password?token='.$this->token.'&email='.$email;
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject(__('auth.reset_subject'))
            ->line(__('auth.reset_line'))
            ->action(__('auth.reset_action'), $this->resetUrl($notifiable))
            ->line(__('auth.reset_expire', ['count' => config('auth.passwords.users.expire')]));
    }
}
