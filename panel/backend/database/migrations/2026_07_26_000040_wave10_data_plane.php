<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ftp_accounts', function (Blueprint $table) {
            $table->unsignedInteger('quota_mb')->nullable()->after('domain');
            $table->boolean('enabled')->default(true)->after('quota_mb');
        });

        Schema::table('hosting_databases', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('cron_jobs', function (Blueprint $table) {
            $table->string('task_type', 32)->default('shell')->after('command');
            $table->json('task_config')->nullable()->after('task_type');
            $table->boolean('notify_on_failure')->default(false)->after('task_config');
        });

        Schema::create('dns_providers', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 32);
            $table->text('api_token_encrypted')->nullable();
            $table->string('default_zone_id', 64)->nullable();
            $table->boolean('enabled')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dns_providers');

        Schema::table('cron_jobs', function (Blueprint $table) {
            $table->dropColumn(['task_type', 'task_config', 'notify_on_failure']);
        });

        Schema::table('hosting_databases', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('ftp_accounts', function (Blueprint $table) {
            $table->dropColumn(['quota_mb', 'enabled']);
        });
    }
};
