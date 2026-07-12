<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
  public function createApplication(): \Illuminate\Foundation\Application
  {
    return require __DIR__.'/../bootstrap/app.php';
  }
}
