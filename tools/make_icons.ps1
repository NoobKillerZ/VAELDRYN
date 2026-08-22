# Icono de VAELDRYN: castillo dorado defendiendo contra el portal del Caos
Add-Type -AssemblyName System.Drawing

function MakeIcon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'

  # --- Fondo degradado nocturno ---
  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,
    [System.Drawing.Color]::FromArgb(255, 40, 28, 16),
    [System.Drawing.Color]::FromArgb(255, 10, 6, 3), 75)
  $g.FillRectangle($bg, $rect)

  $u = $size / 100.0

  function Battlement([float]$x, [float]$y, [float]$w, [float]$h, [int]$n, [System.Drawing.Brush]$br) {
    $step = $w / (2 * $n)
    for ($i = 0; $i -lt $n; $i++) {
      $g.FillRectangle($br, ($x + $i * 2 * $step), $y, $step, $h)
    }
  }

  # --- PORTAL DEL CAOS (izquierda): halo + anillo + vortice ---
  $pcx = 27 * $u; $pcy = 52 * $u; $prOut = 21 * $u; $prIn = 13.5 * $u
  # halo exterior suave
  $haloPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $null = $haloPath.AddEllipse(($pcx - $prOut * 1.45), ($pcy - $prOut * 1.45), ($prOut * 2.9), ($prOut * 2.9))
  $halo = New-Object System.Drawing.Drawing2D.PathGradientBrush($haloPath)
  $halo.CenterColor = [System.Drawing.Color]::FromArgb(150, 176, 138, 255)
  $halo.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 90, 42, 154))
  $g.FillEllipse($halo, ($pcx - $prOut * 1.45), ($pcy - $prOut * 1.45), ($prOut * 2.9), ($prOut * 2.9))
  # disco interior con gradiente radial violeta
  $corePath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $null = $corePath.AddEllipse(($pcx - $prIn), ($pcy - $prIn), ($prIn * 2), ($prIn * 2))
  $core = New-Object System.Drawing.Drawing2D.PathGradientBrush($corePath)
  $core.CenterColor = [System.Drawing.Color]::FromArgb(255, 216, 178, 255)
  $core.SurroundColors = @([System.Drawing.Color]::FromArgb(255, 74, 26, 128))
  $g.FillEllipse($core, ($pcx - $prIn), ($pcy - $prIn), ($prIn * 2), ($prIn * 2))
  # anillo brillante
  $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 196, 160, 255), (2.6 * $u))
  $g.DrawEllipse($ringPen, ($pcx - $prIn), ($pcy - $prIn), ($prIn * 2), ($prIn * 2))

  # --- CASTILLO DORADO (derecha): torre trasera + muralla frontal ---
  $backGold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 201, 152, 60))
  $frontGold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 242, 200, 106))
  $dark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 24, 14, 5))
  $red = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 179, 48, 42))
  # torre alta al fondo
  $g.FillRectangle($backGold, 76 * $u, 18 * $u, 15 * $u, 66 * $u)
  Battlement (76 * $u) (12.5 * $u) (15 * $u) (6 * $u) 3 $backGold
  $g.FillRectangle($dark, 81.5 * $u, 26 * $u, 4 * $u, 7 * $u)
  # muralla principal
  $g.FillRectangle($frontGold, 55 * $u, 44 * $u, 39 * $u, 40 * $u)
  Battlement (55 * $u) (37.5 * $u) (39 * $u) (7 * $u) 4 $frontGold
  # ventanas de la muralla
  $g.FillRectangle($dark, 61 * $u, 52 * $u, 4.5 * $u, 8 * $u)
  $g.FillRectangle($dark, 83.5 * $u, 52 * $u, 4.5 * $u, 8 * $u)
  # puerta con arco
  $doorW = 13 * $u; $doorH = 19 * $u; $dx = 74.5 * $u - ($doorW / 2); $dy = 84 * $u - $doorH
  $g.FillRectangle($dark, $dx, ($dy + $doorW / 2), $doorW, ($doorH - $doorW / 2))
  $g.FillPie($dark, $dx, $dy, $doorW, $doorW, 180, 180)
  # estandarte rojo sobre la muralla
  $poleX = 54.2 * $u
  $g.FillRectangle($frontGold, $poleX, 25 * $u, 1.5 * $u, 20 * $u)
  $pts = @(
    (New-Object System.Drawing.PointF(($poleX + 1.5 * $u), (26 * $u))),
    (New-Object System.Drawing.PointF(($poleX + 10 * $u), (28.8 * $u))),
    (New-Object System.Drawing.PointF(($poleX + 1.5 * $u), (33 * $u)))
  )
  $g.FillPolygon($red, $pts)

  # --- FLECHA EN VUELO (castillo -> portal) ---
  $shaftPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 232, 213, 168), (2.2 * $u))
  $shaftPen.StartCap = 'Flat'; $shaftPen.EndCap = 'Flat'
  $tailX = 47 * $u; $tailY = 33 * $u; $tipX = 35.5 * $u; $tipY = 41 * $u
  $g.DrawLine($shaftPen, ([float]$tailX), ([float]$tailY), ([float]$tipX), ([float]$tipY))
  # punta de acero
  $steel = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 216, 220, 228))
  $ang = [math]::Atan2(($tipY - $tailY), ($tipX - $tailX)); $hl = 5.5 * $u
  $cA = [math]::Cos($ang); $sA = [math]::Sin($ang)
  $p1 = [System.Drawing.PointF]::new([float](($tipX + $cA * $hl) * $u), [float](($tipY + $sA * $hl) * $u))
  $p2 = [System.Drawing.PointF]::new([float](($tipX + [math]::Cos($ang + 2.6) * $hl) * $u), [float](($tipY + [math]::Sin($ang + 2.6) * $hl) * $u))
  $p3 = [System.Drawing.PointF]::new([float](($tipX + [math]::Cos($ang - 2.6) * $hl) * $u), [float](($tipY + [math]::Sin($ang - 2.6) * $hl) * $u))
  $g.FillPolygon($steel, @($p1, $p2, $p3))
  # plumas rojas
  foreach ($fa in @(2.5, 3.78)) {
    $q1 = [System.Drawing.PointF]::new([float](($tailX - $cA * 1 * $u)), [float](($tailY - $sA * 1 * $u)))
    $q2 = [System.Drawing.PointF]::new([float](($tailX + [math]::Cos($ang + $fa) * 4 * $u)), [float](($tailY + [math]::Sin($ang + $fa) * 4 * $u)))
    $q3 = [System.Drawing.PointF]::new([float](($tailX + $cA * 3.2 * $u)), [float](($tailY + $sA * 3.2 * $u)))
    $g.FillPolygon($red, @($q1, $q2, $q3))
  }

  # --- Marco dorado ---
  $frame = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 138, 106, 42), (2.4 * $u))
  $g.DrawRectangle($frame, (1.2 * $u), (1.2 * $u), $size - (2.4 * $u), $size - (2.4 * $u))

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "icono OK: $path"
}

New-Item -ItemType Directory -Force -Path "icons", "desktop\icons" | Out-Null
MakeIcon 512 "icons\icon-512.png"
MakeIcon 192 "icons\icon-192.png"
MakeIcon 180 "icons\apple-touch-icon.png"
Copy-Item "icons\icon-512.png" "desktop\icons\icon.png" -Force
Write-Output "listo"
