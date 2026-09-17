import { supabase } from './lib/supabase';

// Corrección independiente del resumen de horas.
// Se ejecuta cuando la vista "Ver registros" está presente y no depende
// de las relaciones con categorías/proyectos/clientes.

function fechaLocalISO(fecha = new Date()): string {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

function formatearTiempo(minutos: number): string {
  const total = Math.max(0, Math.floor(Number(minutos) || 0));
  const horas = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function aplicarDiseñoResumen() {
  if (document.getElementById('eon-resumen-fix-style')) return;

  const style = document.createElement('style');
  style.id = 'eon-resumen-fix-style';
  style.textContent = `
    #resumenHoras > div:first-child {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 0.75rem !important;
    }
    #resumenHoras > div:first-child > article:first-child {
      grid-column: 1 / -1 !important;
    }
    @media (max-width: 600px) {
      #resumenHoras > div:first-child {
        grid-template-columns: 1fr !important;
      }
      #resumenHoras > div:first-child > article {
        grid-column: 1 / -1 !important;
      }
    }
  `;
  document.head.appendChild(style);
}

async function actualizarResumen() {
  const horasDia = document.getElementById('horasDia');
  const horasSemana = document.getElementById('horasSemana');
  const horasMes = document.getElementById('horasMes');

  if (!horasDia || !horasSemana || !horasMes) return;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const hoy = new Date();
  const hoyISO = fechaLocalISO(hoy);
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const diaSemana = hoy.getDay();
  const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;
  const inicioSemana = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate() - diasDesdeLunes
  );

  // Sin filtro de fecha: traemos los registros del usuario y calculamos
  // los tres períodos localmente. Así evitamos cualquier problema con
  // comparaciones de fechas o relaciones de Supabase.
  const { data, error } = await supabase
    .from('registros')
    .select('fecha, tiempo_minutos')
    .eq('user_id', userId);

  if (error) {
    console.error('EÓN: no se pudo cargar el resumen:', error);
    return;
  }

  const inicioSemanaISO = fechaLocalISO(inicioSemana);
  const inicioMesISO = fechaLocalISO(inicioMes);
  const registros = data ?? [];

  const hoyTotal = registros
    .filter((r: any) => r.fecha === hoyISO)
    .reduce((total: number, r: any) => total + Number(r.tiempo_minutos || 0), 0);

  const semanaTotal = registros
    .filter((r: any) => r.fecha >= inicioSemanaISO && r.fecha <= hoyISO)
    .reduce((total: number, r: any) => total + Number(r.tiempo_minutos || 0), 0);

  const mesTotal = registros
    .filter((r: any) => r.fecha >= inicioMesISO && r.fecha <= hoyISO)
    .reduce((total: number, r: any) => total + Number(r.tiempo_minutos || 0), 0);

  horasDia.textContent = formatearTiempo(hoyTotal);
  horasSemana.textContent = formatearTiempo(semanaTotal);
  horasMes.textContent = formatearTiempo(mesTotal);
}

function revisarVista() {
  const resumen = document.getElementById('resumenHoras');
  if (!resumen) return;
  aplicarDiseñoResumen();
  void actualizarResumen();
}

// La aplicación es una SPA y crea/destruye la vista dinámicamente.
// El observer detecta cuando aparece "Ver registros".
const observer = new MutationObserver(() => revisarVista());
observer.observe(document.body, { childList: true, subtree: true });

revisarVista();
setInterval(revisarVista, 30000);
