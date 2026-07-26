<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Runtimes\Providers\RuntimesServiceProvider;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('runtimes_versions', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 64)->unique();
            $table->string('runtime', 32);
            $table->string('name');
            $table->string('install_method', 32);
            $table->string('agent_script_id', 64);
            $table->string('version_label', 64)->nullable();
            $table->string('status', 32)->default('available');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('runtimes_projects', function (Blueprint $table) {
            $table->id();
            $table->string('name', 64)->unique();
            $table->string('runtime', 32);
            $table->foreignId('runtime_version_id')->nullable()->constrained('runtimes_versions')->nullOnDelete();
            $table->string('work_dir');
            $table->string('entry_script')->nullable();
            $table->string('npm_script')->nullable();
            $table->unsignedSmallInteger('port')->nullable();
            $table->string('status', 32)->default('stopped');
            $table->unsignedInteger('pid')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        RuntimesServiceProvider::seedCatalog();
    }

    public function down(): void
    {
        Schema::dropIfExists('runtimes_projects');
        Schema::dropIfExists('runtimes_versions');
    }
};
