<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ssl_certificates', function (Blueprint $table) {
            $table->string('type')->default('letsencrypt')->after('domain');
            $table->json('sans')->nullable()->after('type');
            $table->string('challenge')->default('http')->after('sans');
            $table->boolean('auto_renew')->default(true)->after('challenge');
            $table->string('service_binding')->nullable()->after('auto_renew');
            $table->unsignedSmallInteger('alert_days')->default(14)->after('service_binding');
            $table->string('cert_path')->nullable()->after('alert_days');
            $table->string('key_path')->nullable()->after('cert_path');
            $table->timestamp('last_renewed_at')->nullable()->after('key_path');
            $table->timestamp('last_alert_at')->nullable()->after('last_renewed_at');
        });
    }

    public function down(): void
    {
        Schema::table('ssl_certificates', function (Blueprint $table) {
            $table->dropColumn([
                'type', 'sans', 'challenge', 'auto_renew', 'service_binding',
                'alert_days', 'cert_path', 'key_path', 'last_renewed_at', 'last_alert_at',
            ]);
        });
    }
};
