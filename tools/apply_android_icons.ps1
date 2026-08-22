# Aplica los iconos/splash tematicos al proyecto Android de Capacitor
Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile("$PWD\icons\icon-512.png")

function Resize([System.Drawing.Image]$img, [int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($img, 0, 0, $size, $size)
  $g.Dispose()
  return $bmp
}

# 1) Iconos de lanzador por densidad
$densities = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
foreach ($d in $densities.Keys) {
  $dir = "android\app\src\main\res\mipmap-$d"
  if (-not (Test-Path $dir)) { continue }
  $b = Resize $src $densities[$d]
  $b.Save("$dir\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
  $b.Save("$dir\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
  $b.Dispose()
  Write-Output "mipmap-$d actualizado ($($densities[$d])px)"
}

# 2) Elimina iconos adaptativos XML que pisarian los PNG con el robot por defecto
$v26 = "android\app\src\main\res\mipmap-anydpi-v26"
if (Test-Path $v26) {
  Remove-Item "$v26\ic_launcher.xml", "$v26\ic_launcher_round.xml" -Force -ErrorAction SilentlyContinue
  Write-Output "adaptativos v26 retirados (fallback a PNG)"
}

# 3) Splash: fondo nocturno + castillo centrado
$splashes = Get-ChildItem "android\app\src\main\res" -Recurse -Filter "splash.png"
foreach ($sp in $splashes) {
  $old = [System.Drawing.Image]::FromFile($sp.FullName)
  $w = $old.Width; $h = $old.Height; $old.Dispose()
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,
    [System.Drawing.Color]::FromArgb(255, 40, 28, 16),
    [System.Drawing.Color]::FromArgb(255, 10, 6, 3), 75)
  $g.FillRectangle($bg, $rect)
  $side = [int]([math]::Min($w, $h) * 0.42)
  $icon = Resize $src $side
  $g.DrawImage($icon, [int](($w - $side) / 2), [int](($h - $side) / 2), $side, $side)
  $g.Dispose(); $icon.Dispose()
  $bmp.Save($sp.FullName, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
Write-Output "splash actualizados: $($splashes.Count)"
$src.Dispose()
