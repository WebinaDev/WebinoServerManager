<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('docker_apps', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('image');
            $table->string('container_id')->nullable();
            $table->json('ports')->nullable();
            $table->text('env_encrypted')->nullable();
            $table->json('volumes')->nullable();
            $table->string('restart_policy')->default('unless-stopped');
            $table->string('proxy_domain')->nullable();
            $table->unsignedInteger('proxy_port')->nullable();
            $table->foreignId('hosting_account_id')->nullable()->constrained('hosting_accounts')->nullOnDelete();
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        if (Schema::hasTable('hosting_plans') && ! Schema::hasColumn('hosting_plans', 'max_apps')) {
            Schema::table('hosting_plans', function (Blueprint $table) {
                $table->unsignedInteger('max_apps')->default(5)->after('max_cron');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('docker_apps');

        if (Schema::hasTable('hosting_plans') && Schema::hasColumn('hosting_plans', 'max_apps')) {
            Schema::table('hosting_plans', function (Blueprint $table) {
                $table->dropColumn('max_apps');
            });
        }
    }
};
