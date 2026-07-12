<?php

namespace Modules\Webhooks\Listeners;

use App\Events\AlertFired;
use App\Events\BackupCompleted;
use App\Events\SslExpiring;
use App\Events\UserCreated;
use Modules\Webhooks\Services\WebhookDispatcher;

class DispatchWebhooks
{
    public function __construct(private readonly WebhookDispatcher $dispatcher) {}

    public function handleBackupCompleted(BackupCompleted $event): void
    {
        $this->dispatcher->dispatch($event->event, $event->payload);
    }

    public function handleSslExpiring(SslExpiring $event): void
    {
        $this->dispatcher->dispatch($event->event, $event->payload);
    }

    public function handleAlertFired(AlertFired $event): void
    {
        $this->dispatcher->dispatch($event->event, $event->payload);
    }

    public function handleUserCreated(UserCreated $event): void
    {
        $this->dispatcher->dispatch($event->event, $event->payload);
    }
}
