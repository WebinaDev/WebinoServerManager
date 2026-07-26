<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Softstore\Providers\SoftstoreServiceProvider;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('docker_compose_projects', function (Blueprint $table) {
            $table->id();
            $table->string('name', 64)->unique();
            $table->string('project_dir', 512);
            $table->longText('compose_yaml');
            $table->longText('env_file')->nullable();
            $table->string('status', 32)->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('docker_registries', function (Blueprint $table) {
            $table->id();
            $table->string('name', 128);
            $table->string('server', 255);
            $table->string('username', 255);
            $table->text('password_encrypted');
            $table->timestamps();
            $table->unique(['server', 'username']);
        });

        SoftstoreServiceProvider::seedCatalog();
    }

    public function down(): void
    {
        Schema::dropIfExists('docker_registries');
        Schema::dropIfExists('docker_compose_projects');
    }
};
