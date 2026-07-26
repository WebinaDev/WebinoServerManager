<?php

namespace Modules\Apps\Entities;

use Illuminate\Database\Eloquent\Model;

class DockerComposeProject extends Model
{
    protected $table = 'docker_compose_projects';

    protected $fillable = [
        'name',
        'project_dir',
        'compose_yaml',
        'env_file',
        'status',
        'last_error',
    ];
}
