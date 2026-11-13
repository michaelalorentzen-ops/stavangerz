/** Decorative item illustrations. Catalog names/counts and availability stay in the inventory. */
const CELLS:Record<string,readonly[number,number]>={food:[0,0],water:[1,0],medicine:[2,0],fuel:[3,0],ammo:[0,1],building:[1,1],crowbar:[2,1],binoculars:[3,1],toolbox:[0,2],flashlight:[1,2],medkit:[2,2],helmet:[3,2],vest:[0,3],workcoat:[1,3],pistol:[2,3],rifle:[3,3]};
export const hasItemArt=(id?:string)=>!!id&&!!CELLS[id];
export function ItemArt({id}:{id:string}){const cell=CELLS[id];return cell?<span aria-hidden="true" className="item-art" data-item-art={id} style={{backgroundPosition:`${cell[0]*100/3}% ${cell[1]*100/3}%`}}/>:null;}
