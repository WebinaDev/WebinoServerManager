<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Softstore\Providers\SoftstoreServiceProvider;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('softstore_packages', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 64)->unique();
            $table->string('name');
            $table->string('category', 32);
            $table->text('description')->nullable();
            $table->string('version_label', 64)->nullable();
            $table->string('agent_script_id', 64);
            $table->boolean('pinable')->default(true);
            $table->timestamps();
        });

        Schema::create('softstore_installs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('package_id')->constrained('softstore_packages')->cascadeOnDelete();
            $table->string('status', 32)->default('pending');
            $table->longText('log')->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('website_id')->nullable();
            $table->timestamps();
        });

        Schema::create('softstore_pins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('package_id')->constrained('softstore_packages')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'package_id']);
        });

        SoftstoreServiceProvider::seedCatalog();
    }

    public function down(): void
    {
        Schema::dropIfExists('softstore_pins');
        Schema::dropIfExists('softstore_installs');
        Schema::dropIfExists('softstore_packages');
    }
};
