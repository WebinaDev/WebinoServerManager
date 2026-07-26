<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Softstore\Providers\SoftstoreServiceProvider;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('setup_stack_runs', function (Blueprint $table) {
            $table->id();
            $table->string('status', 32)->default('pending'); // pending|running|success|failed|skipped
            $table->boolean('skip')->default(false);
            $table->json('config')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();
        });

        Schema::create('setup_stack_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('run_id')->constrained('setup_stack_runs')->cascadeOnDelete();
            $table->unsignedSmallInteger('position');
            $table->string('slug', 64);
            $table->string('script_id', 64);
            $table->string('label', 128);
            $table->string('status', 32)->default('pending'); // pending|running|success|failed|skipped
            $table->longText('log')->nullable();
            $table->timestamps();

            $table->index(['run_id', 'position']);
        });

        SoftstoreServiceProvider::seedCatalog();
    }

    public function down(): void
    {
        Schema::dropIfExists('setup_stack_steps');
        Schema::dropIfExists('setup_stack_runs');
    }
};
