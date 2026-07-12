<?php

namespace Modules\Monitoring\Services;

use App\Models\User;
use App\Services\Mail\PanelMailConfigurator;
use App\Services\Security\OutboundUrlGuard;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Modules\Monitoring\Entities\NotificationChannel;

class NotificationDispatcher
{
    /**
     * @param  array<string>|null  $channelTypes
     */
    public function dispatch(string $subject, string $body, ?array $channelTypes = null): void
    {
        $query = NotificationChannel::query()->where('enabled', true);
        if ($channelTypes !== null && $channelTypes !== []) {
            $query->whereIn('type', $channelTypes);
        }

        foreach ($query->get() as $channel) {
            $this->sendToChannel($channel, $subject, $body);
        }

        if ($channelTypes === null || in_array('email', $channelTypes, true)) {
            $this->sendEmailFallback($subject, $body);
        }
    }

    private function sendToChannel(NotificationChannel $channel, string $subject, string $body): void
    {
        $config = $channel->config ?? [];

        match ($channel->type) {
            'telegram' => $this->sendTelegram($config, $body),
            'slack' => $this->sendSlack($config, $body),
            'webhook' => $this->sendWebhook($config, $subject, $body),
            'email' => $this->sendEmailTo($config['email'] ?? null, $subject, $body),
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function sendTelegram(array $config, string $body): void
    {
        $token = $config['bot_token'] ?? '';
        $chatId = $config['chat_id'] ?? '';
        if ($token === '' || $chatId === '') {
            return;
        }
        Http::timeout(15)->post("https://api.telegram.org/bot{$token}/sendMessage", [
            'chat_id' => $chatId,
            'text' => $body,
        ]);
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function sendSlack(array $config, string $body): void
    {
        $url = $config['webhook_url'] ?? '';
        if ($url === '') {
            return;
        }
        try {
            OutboundUrlGuard::assertSafeHttpUrl($url);
            Http::timeout(15)->asJson()->post($url, ['text' => $body]);
        } catch (\InvalidArgumentException) {
            return;
        }
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function sendWebhook(array $config, string $subject, string $body): void
    {
        $url = $config['url'] ?? '';
        if ($url === '') {
            return;
        }
        try {
            OutboundUrlGuard::assertSafeHttpUrl($url);
            Http::timeout(15)->asJson()->post($url, [
                'subject' => $subject,
                'body' => $body,
            ]);
        } catch (\InvalidArgumentException) {
            return;
        }
    }

    private function sendEmailFallback(string $subject, string $body): void
    {
        if (! PanelMailConfigurator::isConfigured()) {
            return;
        }
        PanelMailConfigurator::applyFromSettings();
        $admin = User::query()->role('admin')->whereNotNull('email')->first();
        if ($admin) {
            Mail::raw($body, fn ($m) => $m->to($admin->email)->subject($subject));
        }
    }

    private function sendEmailTo(?string $email, string $subject, string $body): void
    {
        if ($email === null || $email === '' || ! PanelMailConfigurator::isConfigured()) {
            return;
        }
        PanelMailConfigurator::applyFromSettings();
        Mail::raw($body, fn ($m) => $m->to($email)->subject($subject));
    }

    public function sendTestToChannel(NotificationChannel $channel, string $subject, string $body): void
    {
        $this->sendToChannel($channel, $subject, $body);
    }
}
