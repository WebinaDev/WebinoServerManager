<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hosting_plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->unsignedBigInteger('disk_mb')->default(1024);
            $table->unsignedBigInteger('bandwidth_mb')->default(10240);
            $table->unsignedBigInteger('inodes')->default(100000);
            $table->unsignedInteger('max_domains')->default(1);
            $table->unsignedInteger('max_subdomains')->default(5);
            $table->unsignedInteger('max_databases')->default(2);
            $table->unsignedInteger('max_mailboxes')->default(5);
            $table->unsignedInteger('max_ftp')->default(2);
            $table->unsignedInteger('max_cron')->default(5);
            $table->decimal('price', 10, 2)->nullable();
            $table->boolean('enabled')->default(true);
            $table->timestamps();
        });

        Schema::create('hosting_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('plan_id')->constrained('hosting_plans')->cascadeOnDelete();
            $table->string('username')->unique();
            $table->string('primary_domain')->nullable();
            $table->string('status')->default('active');
            $table->timestamp('suspended_at')->nullable();
            $table->text('suspend_reason')->nullable();
            $table->unsignedBigInteger('disk_used_mb')->default(0);
            $table->unsignedBigInteger('inodes_used')->default(0);
            $table->timestamp('last_usage_at')->nullable();
            $table->timestamps();
        });

        $tables = [
            'hosting_databases',
            'hosting_subdomains',
            'ftp_accounts',
            'mail_accounts',
            'cron_jobs',
            'hosting_domains',
        ];

        foreach ($tables as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }
            if (Schema::hasColumn($tableName, 'hosting_account_id')) {
                continue;
            }
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignId('hosting_account_id')->nullable()->after('id')->constrained('hosting_accounts')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        $tables = [
            'hosting_databases',
            'hosting_subdomains',
            'ftp_accounts',
            'mail_accounts',
            'cron_jobs',
            'hosting_domains',
        ];

        foreach ($tables as $tableName) {
            if (! Schema::hasTable($tableName) || ! Schema::hasColumn($tableName, 'hosting_account_id')) {
                continue;
            }
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropConstrainedForeignId('hosting_account_id');
            });
        }

        Schema::dropIfExists('hosting_accounts');
        Schema::dropIfExists('hosting_plans');
    }
};
