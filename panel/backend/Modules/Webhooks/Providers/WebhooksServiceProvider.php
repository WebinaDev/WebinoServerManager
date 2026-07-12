<?php

namespace Modules\Webhooks\Providers;

use App\Events\AlertFired;
use App\Events\BackupCompleted;
use App\Events\SslExpiring;
use App\Events\UserCreated;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Modules\Webhooks\Listeners\DispatchWebhooks;

class WebhooksServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Webhooks', 'Routes/api.php'));

        $listener = DispatchWebhooks::class;
        Event::listen(BackupCompleted::class, [$listener, 'handleBackupCompleted']);
        Event::listen(SslExpiring::class, [$listener, 'handleSslExpiring']);
        Event::listen(AlertFired::class, [$listener, 'handleAlertFired']);
        Event::listen(UserCreated::class, [$listener, 'handleUserCreated']);
    }
}
