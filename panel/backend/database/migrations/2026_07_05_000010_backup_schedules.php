<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_schedules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type');
            $table->string('target');
            $table->string('frequency')->default('daily');
            $table->unsignedInteger('retention_days')->default(7);
            $table->boolean('enabled')->default(true);
            $table->timestamp('last_run_at')->nullable();
            $table->timestamp('next_run_at')->nullable();
            $table->timestamps();
        });

        Schema::table('backups', function (Blueprint $table) {
            $table->foreignId('schedule_id')->nullable()->after('id')->constrained('backup_schedules')->nullOnDelete();
            $table->string('trigger')->default('manual')->after('schedule_id');
        });
    }

    public function down(): void
    {
        Schema::table('backups', function (Blueprint $table) {
            $table->dropConstrainedForeignId('schedule_id');
            $table->dropColumn('trigger');
        });
        Schema::dropIfExists('backup_schedules');
    }
};
