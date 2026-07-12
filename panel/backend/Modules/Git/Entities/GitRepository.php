<?php

namespace Modules\Git\Entities;

use Illuminate\Database\Eloquent\Model;

class GitRepository extends Model
{
    protected $fillable = [
        'name',
        'repo_url',
        'branch',
        'target_dir',
        'status',
        'last_error',
    ];
}
