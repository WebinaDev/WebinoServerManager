<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('metric_samples', function (Blueprint $table) {
            $table->id();
            $table->float('cpu_percent')->default(0);
            $table->float('mem_percent')->default(0);
            $table->float('disk_percent')->default(0);
            $table->float('load1')->default(0);
            $table->timestamp('collected_at')->index();
            $table->timestamps();
        });

        Schema::create('metric_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('metric');
            $table->string('comparison')->default('gt');
            $table->float('threshold');
            $table->boolean('enabled')->default(true);
            $table->string('channel')->default('email');
            $table->timestamp('last_triggered_at')->nullable();
            $table->unsignedInteger('cooldown_minutes')->default(60);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metric_alerts');
        Schema::dropIfExists('metric_samples');
    }
};
