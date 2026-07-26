<?php

namespace Modules\Webhooks\Providers;

use App\Events\AlertFired;
use App\Events\BackupCompleted;
use App\Events\SslExpiring;
use App\Events\UserCreated;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;
use Modules\Webhooks\Listeners\DispatchWebhooks;

class WebhooksServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Webhooks');

        $listener = DispatchWebhooks::class;
        Event::listen(BackupCompleted::class, [$listener, 'handleBackupCompleted']);
        Event::listen(SslExpiring::class, [$listener, 'handleSslExpiring']);
        Event::listen(AlertFired::class, [$listener, 'handleAlertFired']);
        Event::listen(UserCreated::class, [$listener, 'handleUserCreated']);
    }
}
