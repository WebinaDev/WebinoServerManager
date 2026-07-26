<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ftp_accounts')) {
            Schema::table('ftp_accounts', function (Blueprint $table) {
                if (! Schema::hasColumn('ftp_accounts', 'quota_mb')) {
                    $table->unsignedInteger('quota_mb')->nullable()->after('domain');
                }
                if (! Schema::hasColumn('ftp_accounts', 'enabled')) {
                    $table->boolean('enabled')->default(true)->after('quota_mb');
                }
            });
        }

        if (Schema::hasTable('hosting_databases') && ! Schema::hasColumn('hosting_databases', 'deleted_at')) {
            Schema::table('hosting_databases', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        if (Schema::hasTable('cron_jobs')) {
            Schema::table('cron_jobs', function (Blueprint $table) {
                if (! Schema::hasColumn('cron_jobs', 'task_type')) {
                    $table->string('task_type', 32)->default('shell')->after('command');
                }
                if (! Schema::hasColumn('cron_jobs', 'task_config')) {
                    $table->json('task_config')->nullable()->after('task_type');
                }
                if (! Schema::hasColumn('cron_jobs', 'notify_on_failure')) {
                    $table->boolean('notify_on_failure')->default(false)->after('task_config');
                }
            });
        }

        if (! Schema::hasTable('dns_providers')) {
            Schema::create('dns_providers', function (Blueprint $table) {
                $table->id();
                $table->string('provider', 32);
                $table->text('api_token_encrypted')->nullable();
                $table->string('default_zone_id', 64)->nullable();
                $table->boolean('enabled')->default(false);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('dns_providers');

        if (Schema::hasTable('cron_jobs')) {
            Schema::table('cron_jobs', function (Blueprint $table) {
                foreach (['notify_on_failure', 'task_config', 'task_type'] as $col) {
                    if (Schema::hasColumn('cron_jobs', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('hosting_databases') && Schema::hasColumn('hosting_databases', 'deleted_at')) {
            Schema::table('hosting_databases', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }

        if (Schema::hasTable('ftp_accounts')) {
            Schema::table('ftp_accounts', function (Blueprint $table) {
                foreach (['enabled', 'quota_mb'] as $col) {
                    if (Schema::hasColumn('ftp_accounts', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
